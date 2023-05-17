import fs from 'fs/promises';
import path from 'path';

const PATH_ARG = '--path=';
const EXT_ARG = '--ext=';
const IGNORE_ARG = '--ignore=';
const DEFAULT_IGNORE = ['node_modules', 'build', 'lib', 'dist', 'coverage', 'public', 'static', 'assets'];
const DEFAULT_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

/**
 * Recursively get all files in a directory and subdirectories with a given extension.
 * @param {string} home
 * @param {string[]} extensions
 * @param {string[]} ignore
 * @return {*}  {Promise<string[]>}
 */
async function getAllFiles(home: string, extensions: string[], ignore: string[]): Promise<string[]> {
  const files = await fs.readdir(home);
  const paths: string[] = [];
  for (const file of files) {
    const filePath = path.join(home, file);
    const stat = await fs.lstat(filePath);
    if (stat.isDirectory()) {
      // Skip folders like node_modules, build, dist etc.
      if (ignore.includes(file)) {
        continue;
      }
      const subFiles = await getAllFiles(filePath, extensions, ignore);
      paths.push(...subFiles);
    } else {
      const ext = path.extname(filePath);
      if (extensions.includes(ext)) {
        paths.push(filePath);
      }
    }
  }
  return paths;
}

type FileDetails = {
  path: string;
  contents: string;
  exports: string[];
};

/**
 * For a list of paths, return the file contents and a list of exports for each file.
 * @param {string[]} files
 * @return {*}  {Promise<FileDetails[]>}
 */
async function getExports(files: string[]): Promise<FileDetails[]> {
  const fileExports: FileDetails[] = [];

  for (const file of files) {
    const contents = await fs.readFile(file, 'utf-8');
    const exportsStatements = contents.match(
      /export\s+(const|let|var|class|interface|type|enum|default async function|default function|function|default)\s+(\w+)/g,
    );

    const validMatches: string[] = exportsStatements ?? [];
    const exports = validMatches.reduce<string[]>((list, statement) => {
      const split = statement.split(' ');
      if (split.length === 0) {
        return list;
      }
      const res = split.at(split.length - 1);
      if (!res) {
        return list;
      }
      return [...list, res];
    }, []);

    fileExports.push({ path: file, exports, contents });
  }

  return fileExports;
}

/**
 * Determines if a given export is imported in a file.
 * @param {string} exportName
 * @param {string} contents
 * @return {*}  {boolean}
 */
function isImported(exportName: string, contents: string): boolean {
  const importStatements = contents.match(new RegExp(`import{1}(.|\n)+(${exportName})+(.|\n)+from.+`, 'gm'));
  if (!importStatements) {
    return false;
  }
  return importStatements.length > 0;
}

type FileWithDeadExports = Map<FileDetails, string[]>;

/**
 * Given a group of files, return the files that contain dead exports.
 * @param {FileDetails[]} files
 * @return {*}  {FileWithDeadExports}
 */
function getFilesWithDeadExports(files: FileDetails[]): FileWithDeadExports {
  const filesWithDeadExports: FileWithDeadExports = new Map();

  for (const fileA of files) {
    const importCounts = fileA.exports.reduce<Record<string, number>>((map, exp) => ({ ...map, [exp]: 0 }), {});

    for (const fileB of files) {
      // Don't bother comparing the same file with itself
      if (fileA === fileB) {
        continue;
      }

      // Loop through exports of a File A
      for (const exp of fileA.exports) {
        // Check if File B imports it
        if (isImported(exp, fileB.contents)) {
          importCounts[exp]++;
        }
      }
    }

    for (const [exp, count] of Object.entries(importCounts)) {
      // If import count if greater than 0, it's not a dead export
      if (count > 0) {
        continue;
      }
      const existingEntry = filesWithDeadExports.get(fileA);
      // Check if this file already has dead exports in the map
      if (existingEntry) {
        existingEntry.push(exp);
      } else {
        filesWithDeadExports.set(fileA, [exp]);
      }
    }
  }

  return filesWithDeadExports;
}

(async function main() {
  // Get the path from the command line e.g. --path=/Users/username/Projects/my-project
  const pathArg = process.argv.find((arg) => arg.startsWith(PATH_ARG));
  if (!pathArg) {
    throw new Error('No path argument provided');
  }
  const basePath = pathArg.split(PATH_ARG)[1];
  const pathIsDir = await fs.lstat(basePath).then((stat) => stat.isDirectory());
  if (!pathIsDir) {
    throw new Error('Path is not a directory');
  }

  // Get the optional extensions from the command line e.g. --ext=ts,tsx
  const extArg = process.argv.find((arg) => arg.startsWith(EXT_ARG));
  const extensions: string[] = [];
  if (extArg) {
    const newExtensions = extArg
      .split(EXT_ARG)[1]
      .split(',')
      .map((ext) => (ext.trim().startsWith('.') ? ext.trim() : `.${ext.trim()}`));
    extensions.push(...newExtensions);
  } else {
    extensions.push(...DEFAULT_EXTENSIONS);
  }

  // Get the optional ignore paths from the command line e.g. --ignore=node_modules,build
  const ignoreArg = process.argv.find((arg) => arg.startsWith(IGNORE_ARG));
  const ignorePaths: string[] = [];
  if (ignoreArg) {
    const newIgnorePaths = ignoreArg
      .split(IGNORE_ARG)[1]
      .split(',')
      .map((path) => path.trim());
    ignorePaths.push(...newIgnorePaths);
  } else {
    ignorePaths.push(...DEFAULT_IGNORE);
  }

  // Process all files in the directory and subdirectories
  const files = await getAllFiles(basePath, extensions, ignorePaths);
  const filesWithExports = await getExports(files);
  const filesWithDeadExports = getFilesWithDeadExports(filesWithExports);

  // Print results
  Array.from(filesWithDeadExports.entries()).forEach(([file, deadExports], index) => {
    console.log(`File #${index + 1}`);
    console.log('Path:', file.path);
    console.log('Dead exports:', deadExports);
    console.log('Total:', deadExports.length, '\n');
  });
  console.log('Total files with dead exports:', filesWithDeadExports.size);
})();
