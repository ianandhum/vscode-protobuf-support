import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

import { getProtolsCommand } from './protols';

let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext) {

	let protolsCommand = await getProtolsCommand();

	if (!protolsCommand) {
		return;
	}

	const serverOptions: ServerOptions = {
		run: {
			command: protolsCommand.command,
			args: protolsCommand.args,
			transport: TransportKind.stdio
		},
		debug: {
			command: protolsCommand.command,
			args: protolsCommand.args,
			transport: TransportKind.stdio
		}
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ scheme: 'file', language: 'proto3' },
			{ scheme: 'file', language: 'proto' }
		],
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
