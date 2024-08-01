import which from 'which';
import * as vscode from 'vscode';
import * as fs from 'fs';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import path from 'path';
import { getProtolsPlatformBinaryName } from './protols_install';

export const PROTOLS_CONFIG_PATH = "protobuf-support.protols";
const PROTOLS_BIN = "protols";

export enum BinaryStatus {
	Ok,
	NotFound,
	Invalid,
	NotInstalled,
}

export interface ProtolsCommand {
	command: string
	args?: string[]
}

export interface ProtolsBinaryStatus {
	status: BinaryStatus,
	command?: ProtolsCommand
}

let client: LanguageClient;

export async function getProtolsCommand(storagePath: string): Promise<ProtolsBinaryStatus> {
	let protolsPath: string = vscode.workspace.getConfiguration(PROTOLS_CONFIG_PATH).get("path") || PROTOLS_BIN;

	if (protolsPath !== PROTOLS_BIN) {
		let status = getBinaryStatus(protolsPath);
		if (status !== BinaryStatus.Ok) {
			vscode.window.showErrorMessage(
				`Protols server binary: '${protolsPath}' is ${status === BinaryStatus.NotFound ? "missing" : "not executable"}, check: ${PROTOLS_CONFIG_PATH} config.`,
			);
			return { status };
		}
	} else {
		let binPath = await which(PROTOLS_BIN, { nothrow: true });
		if (binPath === null) {
			protolsPath = path.join(storagePath, getProtolsPlatformBinaryName());
			let status = getBinaryStatus(protolsPath);
			if (status === BinaryStatus.NotFound) {
				return { status: BinaryStatus.NotInstalled };
			}
	
			if (status !== BinaryStatus.Ok) {
				return { status };
			}
		}
	}

	let protolsArgs: string[] = vscode.workspace.getConfiguration(PROTOLS_CONFIG_PATH).get("args") || [];

	return {
		status: BinaryStatus.Ok,
		command: {
			command: protolsPath,
			args: protolsArgs
		}
	};
}

function getBinaryStatus(path: string): BinaryStatus {
	let binExists = fs.existsSync(path);
	let isExecutable: boolean = false;

	if (binExists) {
		try {
			fs.accessSync(path, fs.constants.X_OK);
			isExecutable = true;
		} catch {
			isExecutable = false;
		}
	}

	if (!binExists) {
		return BinaryStatus.NotFound;
	}

	if (!isExecutable) {
		return BinaryStatus.Invalid;
	}

	return BinaryStatus.Ok;
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