# Protobuf Language Support (Protols)

<a href="https://marketplace.visualstudio.com/items?itemName=ianandhum.protobuf-support" title="VS Code Marketplace Installs">
  <img alt="VS Code Marketplace Installs" src="https://img.shields.io/visual-studio-marketplace/i/ianandhum.protobuf-support">
</a>

This extension provides language support for proto3 Protocol Buffers including syntax highlighting, snippets and language features.

Languages features provided by: https://github.com/coder3101/protols 

## Features

- Syntax Highlighting
- Snippets
- Definitions
- Basic completions
- Diagnostics

## Requirements

Extension will prompt automatic installation of protols if not resolvable from `PATH`, 

You can choose to install `protols` language server from Rust Crates also,

```
cargo install protols
```

If protols is not available in PATH, configure `protobuf-support.protols.path` in `settings.json`.

## Attribution

TextMate grammars and basic snippets are sourced from https://github.com/zxh0/vscode-proto3 
