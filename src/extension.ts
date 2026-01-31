import * as vscode from 'vscode';
import { PROTOLS_EXEC, ProtolsServer } from './protols/server';
import { ProtolsInstaller } from './protols/install';

const PROTOLS_CONFIG_PATH = "protobuf-support.protols";

let protolsServer: ProtolsServer | null = null;
let protolsInstaller: ProtolsInstaller | null = null;

async function initProtolsServer(storagePath?: string): Promise<boolean> {
	if (storagePath) {
		// (re-)initialize
		protolsServer = new ProtolsServer({
			protolsPath: vscode.workspace.getConfiguration(PROTOLS_CONFIG_PATH).get<string>("path") || PROTOLS_EXEC,
			protolsArgs: vscode.workspace.getConfiguration(PROTOLS_CONFIG_PATH).get<string[]>("args") || [],
			storagePath: storagePath,
		});
		protolsInstaller = new ProtolsInstaller(protolsServer);
	}

	if (!protolsServer) {
		throw new Error("Protols server instance is not initialized.");
	}

	let initSuccess = await protolsServer.init();

	if (!initSuccess && protolsServer.needsInstall() && protolsInstaller) {
		const installed = await protolsInstaller.install();

		if (installed) {
			initSuccess = await protolsServer.init(true);
		}
	}

	return initSuccess;
}

async function startProtolsServer(): Promise<void> {
	if (!protolsServer) {
		throw new Error("Protols server instance is not initialized.");
	}

	const started = await protolsServer.start();
	if (!started) {
		vscode.window.showErrorMessage(
			`Failed to start protols Language Server; ".proto" file features will be unavailable.`,
		);
	}
}

async function initAndStartServer(storagePath?: string): Promise<void> {
	const initialized = await initProtolsServer(storagePath);
	if (initialized) {
		await startProtolsServer();
	}
}

async function checkForUpdates(storagePath: string): Promise<void> {
	if (!protolsServer) {
		return;
	}

	protolsInstaller?.checkForUpdatesAndInstall().then(async (updated) => {
		if (updated) {
			await initAndStartServer(storagePath);
		}
	});
};

export async function activate(context: vscode.ExtensionContext) {
	const storagePath = context.globalStorageUri.path;

	const initialzed = await initProtolsServer(storagePath);
	if (initialzed) {
		startProtolsServer();
	}

	vscode.window.onDidChangeActiveTextEditor(async (e) => {
		if (protolsServer !== null && e?.document.languageId === "proto3") {
			if (!protolsServer.isRunning()) {
				initAndStartServer();
			} else if (protolsServer.isAutoInstalled()) {
				checkForUpdates(storagePath);
			}
		}
	});

	vscode.workspace.onDidChangeConfiguration(async (e) => {
		if (e.affectsConfiguration(PROTOLS_CONFIG_PATH)) {
			if (!protolsServer) {
				return;
			}

			await protolsServer.stop();
			initAndStartServer(storagePath);
		}
	});

	// Initial update check
	checkForUpdates(storagePath);
}

export function deactivate(): Thenable<void> | undefined {
	protolsServer?.stop();
	return undefined;
}
