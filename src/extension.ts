import * as vscode from 'vscode';

import { BinaryStatus, getProtolsCommand, isProtolsStarted, PROTOLS_CONFIG_PATH, startProtols, stopProtols } from './protols';
import { installProtolsLanguageServer } from './protols_install';

export async function activate(context: vscode.ExtensionContext) {

	let initProtols = async () => {
		let protolsBinStatus = await getProtolsCommand(context.globalStorageUri.path);

		if (protolsBinStatus.status === BinaryStatus.NotInstalled) {
			protolsBinStatus = await installProtolsLanguageServer(context.globalStorageUri.path);
		}

		if (protolsBinStatus.status === BinaryStatus.Ok && protolsBinStatus.command !== undefined) {
			startProtols(protolsBinStatus.command);
		}
	};
	await initProtols();

	vscode.window.onDidChangeActiveTextEditor(async (e) => {
		if (!isProtolsStarted() && e?.document.languageId === "proto3") {
			await initProtols();
		}
	});

	vscode.workspace.onDidChangeConfiguration(async (e) => {
		if (e.affectsConfiguration(PROTOLS_CONFIG_PATH)) {
			await stopProtols();
			initProtols();
		}
	});

}

export function deactivate(): Thenable<void> | undefined {
	return stopProtols();
}
