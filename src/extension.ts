import * as vscode from 'vscode';
import { PROTOLS_EXEC, ProtolsServer } from './protols/server';
import { ProtolsInstaller } from './protols/install';

const PROTOLS_CONFIG_PATH = "protobuf-support.protols";

let protolsServer: ProtolsServer | null = null;
let protolsInstaller: ProtolsInstaller | null = null;

let shouldCheckForUpdates = true;

async function initAndStartServer(storagePath?: string): Promise<void> {
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

	if (initSuccess) {
		const started = await protolsServer.start();
		if (!started) {
			vscode.window.showErrorMessage(
				`Failed to contextstart protols Language Server; ".proto" file features will be unavailable.`,
			);
		}
	}
}

async function checkAndUpdateProtols(): Promise<boolean> {
	if (!protolsServer || !protolsServer.isAutoInstalled()) {
		return false;
	}

	protolsInstaller?.checkForUpdatesAndInstall().then(async (updated) => {
		if (updated) {
			await initAndStartServer();

			vscode.window.showInformationMessage(
				`protols Language Server has been updated to a new version: '${protolsServer?.getVersion()}'`,
			);
		}
	});

	return true;
};

export async function activate(context: vscode.ExtensionContext) {
	await initAndStartServer(context.globalStorageUri.path);
	checkAndUpdateProtols();

	vscode.window.onDidChangeActiveTextEditor(async (e) => {
		if (protolsServer !== null && e?.document.languageId === "proto3") {
			if (!protolsServer.isRunning()) {
				await initAndStartServer();
			}

			if (protolsServer.isRunning() && shouldCheckForUpdates) {
				if (!await checkAndUpdateProtols()) {
					shouldCheckForUpdates = false;
				}
			}
		}
	});

	vscode.workspace.onDidChangeConfiguration(async (e) => {
		if (e.affectsConfiguration(PROTOLS_CONFIG_PATH)) {
			if (!protolsServer) {
				return;
			}

			await protolsServer.stop();
			await initAndStartServer(context.globalStorageUri.path);
		}
	});

}

export function deactivate(): Thenable<void> | undefined {
	protolsServer?.stop();
	return undefined;
}
