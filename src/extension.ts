import * as vscode from 'vscode';

import { getProtolsCommand, isProtolsStarted, startProtols, stopProtols } from './protols';

export async function activate(context: vscode.ExtensionContext) {
	let initProtols = async () => {
		let protolsCommand = await getProtolsCommand();
		if (protolsCommand) {
			startProtols(protolsCommand);
		}
	};
	await initProtols();

	vscode.window.onDidChangeActiveTextEditor((e) => {
		if (e === undefined) {
			return;
		}
		if (!isProtolsStarted() && e.document.languageId === "proto3"){
			initProtols();
		}
	});
}

export function deactivate(): Thenable<void> | undefined {
	return stopProtols();
}
