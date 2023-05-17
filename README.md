# Dead Exports Scanner

This tool scans for dead exports for JavaScript and TypeScript projects using ES6 import/export syntax.

## Installation

```shell
npm install
# or
yarn install
```

## Usage

```shell
npm run start --path=/path/to/project/src
# or
yarn start --path=/path/to/project/src
```

## Options

| Option   | Description                                                                                | Example                     | Required |
| -------- | ------------------------------------------------------------------------------------------ | --------------------------- | -------- |
| --path   | Path to the project directory you want to scan.                                            | --path=/path/to/project/src | true     |
| --ext    | File extensions to scan for. Defaults to js,jsx,tsx,ts.                                    | --ext=tsx,ts                | false    |
| --ignore | Folder names to ignore. Defaults to node_modules,build,dist,coverage,public,static,assets. | --ignore=node_modules,build | false    |
