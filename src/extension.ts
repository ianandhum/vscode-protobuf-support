import * as vscode from 'vscode';
import { PROTOLS_EXEC, ProtolsServer } from './protols/server';
import { ProtolsInstaller } from './protols/install';

const PROTOLS_CONFIG_PATH = "protobuf-support.protols";

let protolsServer: ProtolsServer | null = null;

function newProtolsServerFromConfig(context: vscode.ExtensionContext): ProtolsServer {
	return new ProtolsServer({
		protolsPath: vscode.workspace.getConfiguration().get<string>(PROTOLS_CONFIG_PATH + ".path") || PROTOLS_EXEC,
		protolsArgs: vscode.workspace.getConfiguration().get<string[]>(PROTOLS_CONFIG_PATH + ".args") || [],
		storagePath: context.globalStorageUri.path,
	});
}


export async function activate(context: vscode.ExtensionContext) {
	protolsServer = newProtolsServerFromConfig(context);

	let initAndStartServer = async () => {
		if (!protolsServer) {
			console.log("BUG: Protols server instance is null");
			return;
		}

		let initSuccess = await protolsServer.initServer();
		let installer = new ProtolsInstaller(protolsServer);

		if (!initSuccess && protolsServer.canAutoInstall()) {
			const installed = await installer.install();
			if (installed) {
				initSuccess = await protolsServer.initServer(true);
			}
		}

		if (initSuccess) {
			const started = await protolsServer.startServer();
			if (!started) {
				vscode.window.showErrorMessage(
					`Failed to start protols Language Server; ".proto" file features will be unavailable.`,
				);
			}
		}

		installer.checkForUpdatesAndInstall().then((updated) => {
			if (updated) {
				protolsServer = newProtolsServerFromConfig(context);
				vscode.window.showInformationMessage(
					`protols Language Server has been updated to a new version: ${protolsServer?.getVersion()}'`,
				);
			}
		});
	};

	await initAndStartServer();

	vscode.window.onDidChangeActiveTextEditor(async (e) => {
		if (!protolsServer?.isRunning() && e?.document.languageId === "proto3") {
			await initAndStartServer();
		}
	});

	vscode.workspace.onDidChangeConfiguration(async (e) => {
		if (e.affectsConfiguration(PROTOLS_CONFIG_PATH)) {
			if (!protolsServer) {
				return;
			}

			await protolsServer.stopServer();
			protolsServer = newProtolsServerFromConfig(context);

			await initAndStartServer();
		}
	});

}

export function deactivate(): Thenable<void> | undefined {
	return protolsServer?.stopServer();
}
