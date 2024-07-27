import * as vscode from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {

	let protolsPath:string = vscode.workspace.getConfiguration("protols").get("path") || "protols";
	let protolsArgs:string[] = vscode.workspace.getConfiguration("protols").get("args") || [];

	const serverOptions: ServerOptions = {
		run: {
			command: protolsPath,
			args: protolsArgs,
			transport: TransportKind.stdio
		},
		debug: {
			command: protolsPath,
			args: protolsArgs,
			transport: TransportKind.stdio
		}
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'proto3' }, {scheme: 'file', language: 'proto'}],
	};

	client = new LanguageClient(
		'protols',
		'Protols Language Server',
		serverOptions,
		clientOptions
	);

	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
