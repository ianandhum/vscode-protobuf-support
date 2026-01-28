import * as assert from 'assert';
import * as sinon from 'sinon';

const proxyquire = require('proxyquire').noCallThru();

suite('Protols main logic', () => {
	let fsStub: any;
	let osStub: any;

	setup(() => {
		fsStub = {
			existsSync: sinon.stub(),
			accessSync: sinon.stub(),
			constants: { X_OK: 1 },
		};

		osStub = {
			platform: sinon.stub(),
			arch: sinon.stub(),
		};
	});

	teardown(() => {
		sinon.restore();
	});

	test('getBinaryStatus -> NotFound when binary does not exist', () => {
		fsStub.existsSync.returns(false);
		const protols = proxyquire('../../src/protols', { fs: fsStub });
		const { BinaryStatus, getBinaryStatus } = protols;
		const status = getBinaryStatus('/some/path');
		assert.strictEqual(status, BinaryStatus.NotFound);
	});

	test('getBinaryStatus -> Invalid when file exists but not executable', () => {
		fsStub.existsSync.returns(true);
		fsStub.accessSync.throws(new Error('not executable'));
		const protols = proxyquire('../../src/protols', { fs: fsStub });
		const { BinaryStatus, getBinaryStatus } = protols;
		const status = getBinaryStatus('/some/path');
		assert.strictEqual(status, BinaryStatus.Invalid);
	});

	test('getBinaryStatus -> Ok when file exists and is executable', () => {
		fsStub.existsSync.returns(true);
		fsStub.accessSync.returns(undefined);
		const protols = proxyquire('../../src/protols', { fs: fsStub });
		const { BinaryStatus, getBinaryStatus } = protols;
		const status = getBinaryStatus('/some/path');
		assert.strictEqual(status, BinaryStatus.Ok);
	});

	test('getProtolsPlatformBinaryName -> returns protols.exe on win32', () => {
		osStub.platform.returns('win32');
		const protolsInstall = proxyquire('../../src/protols_install', { os: osStub });
		const name = protolsInstall.getProtolsPlatformBinaryName();
		assert.strictEqual(name, 'protols.exe');
	});

	test('getProtolsPlatformBinaryName -> returns protols on non-win32', () => {
		osStub.platform.returns('linux');
		const protolsInstall = proxyquire('../../src/protols_install', { os: osStub });
		const name = protolsInstall.getProtolsPlatformBinaryName();
		assert.strictEqual(name, 'protols');
	});

	test('getProtolsGithubAssetName -> linux x64', () => {
		osStub.arch.returns('x64');
		osStub.platform.returns('linux');
		const protolsInstall = proxyquire('../../src/protols_install', { os: osStub });
		const asset = protolsInstall.getProtolsGithubAssetName();
		assert.strictEqual(asset, 'protols-x86_64-unknown-linux-gnu.tar.gz');
	});

	test('getProtolsGithubAssetName -> darwin arm64', () => {
		osStub.arch.returns('arm64');
		osStub.platform.returns('darwin');
		const protolsInstall = proxyquire('../../src/protols_install', { os: osStub });
		const asset = protolsInstall.getProtolsGithubAssetName();
		assert.strictEqual(asset, 'protols-aarch64-apple-darwin.tar.gz');
	});

	test('getProtolsGithubAssetName -> win32 x64', () => {
		osStub.arch.returns('x64');
		osStub.platform.returns('win32');
		const protolsInstall = proxyquire('../../src/protols_install', { os: osStub });
		const asset = protolsInstall.getProtolsGithubAssetName();
		assert.strictEqual(asset, 'protols-x86_64-pc-windows-msvc.zip');
	});

	test('getProtolsGithubAssetName -> throws on unsupported arch', () => {
		osStub.arch.returns('arm'); // unsupported
		osStub.platform.returns('linux');
		const protolsInstall = proxyquire('../../src/protols_install', { os: osStub });
		assert.throws(() => protolsInstall.getProtolsGithubAssetName());
	});

	test('getProtolsGithubAssetName -> throws on unsupported platform', () => {
		osStub.arch.returns('x64');
		osStub.platform.returns('sunos'); // unsupported platform
		const protolsInstall = proxyquire('../../src/protols_install', { os: osStub });
		assert.throws(() => protolsInstall.getProtolsGithubAssetName());
	});
});
