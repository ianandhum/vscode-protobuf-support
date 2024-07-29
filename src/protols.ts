import which from 'which';
import * as vscode from 'vscode';
import * as fs from 'fs';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';


const PROTOLS_CONFIG_PATH = "protobuf-support.protols";
const PROTOLS_BIN = "protols";
const DOCUMENTATION_URI = "https://github.com/ianandhum/vscode-protobuf-support?tab=readme-ov-file#requirements";

interface ProtolsCommand {
	command: string
	args?: string[]
}

var disableWarnings = false;
let client: LanguageClient;


async function showProtolsWarning(): Promise<void> {
	let openDocsAction = "Open Documentation";
	let dontShowAgainAction = "Dont Show Again";

	let selectedAction = await vscode.window.showWarningMessage(
		`Protols language server is not installed, language features are not enabled.
        Install protols using "cargo install protols" to enable language features`,
		openDocsAction,
		dontShowAgainAction);

	switch (selectedAction) {
		case openDocsAction:
			vscode.env.openExternal(vscode.Uri.parse(DOCUMENTATION_URI));
			break;

		case dontShowAgainAction:
			disableWarnings = true;
	}
}

export async function getProtolsCommand(): Promise<false | ProtolsCommand> {
	let protolsPath: string = vscode.workspace.getConfiguration(PROTOLS_CONFIG_PATH).get("path") || PROTOLS_BIN;

	if (protolsPath === PROTOLS_BIN) {
		let binPath = await which(PROTOLS_BIN, { nothrow: true });
		if (binPath === null) {
			await showProtolsWarning();
			return false;
		}
	} else {
		let binExists = fs.existsSync(protolsPath);
		let isExecutable: boolean = false;

		if (binExists) {
			try {
				fs.accessSync(protolsPath, fs.constants.X_OK);
				isExecutable = true;
			} catch {
				isExecutable = false;
			}
		}

		if (!binExists || !isExecutable) {
			await showProtolsWarning();
			return false;
		}
	}

	let protolsArgs: string[] = vscode.workspace.getConfiguration(PROTOLS_CONFIG_PATH).get("args") || [];

	return {
		command: protolsPath,
		args: protolsArgs
	};
}

export function startProtols(cmd: ProtolsCommand) {
	const serverOptions: ServerOptions = {
		run: {
			command: cmd.command,
			args: cmd.args,
			transport: TransportKind.stdio
		},
		debug: {
			command: cmd.command,
			args: cmd.args,
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

export function stopProtols(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

export function isProtolsStarted(): boolean {
	return !!client;
}