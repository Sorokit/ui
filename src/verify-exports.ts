// This file ensures that all public exports are available.
// If any of these are removed from the public API, the build will fail.
//
// It also exports findCircularDependencies, an AST-based check (TypeScript's
// own compiler API, not a new dependency) for import cycles between
// component files and context providers, run from src/__tests__/exports.test.ts.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import ts from "typescript";

import {
  // Types
  type AccountData,
  ActivityTimeline,
  AddressDisplay,
  AssetPill,
  type Balance,
  type ClaimableBalance,
  type ContractEvent,
  ContractEventFeed,
  FeeEstimator,
  GasOptimizer,
  GovernanceDashboard,
  type GovernanceDashboardProps,
  type GovernanceProposal,
  type GroupedTransaction,
  type InvokeParams,
  type NetworkInfo,
  type Nft,
  type Operation,
  PortfolioRebalancer,
  type ProposalStatus,
  SwapSimulator,
  type TimelineFilter,
  type TimelineGroup,
  type Transaction,
  type VoteChoice,
} from "./components/index";

// Dummy usage to prevent unused warnings if strictly checked
console.log({
  ActivityTimeline,
  FeeEstimator,
  GasOptimizer,
  AddressDisplay,
  AssetPill,
  ContractEventFeed,
  GovernanceDashboard,
  SwapSimulator,
  PortfolioRebalancer,
});

// Dummy type usage to prevent unused type warnings
export type TestExports = {
  account: AccountData;
  balance: Balance;
  tx: Transaction;
  claim: ClaimableBalance;
  event: ContractEvent;
  network: NetworkInfo;
  invoke: InvokeParams;
  operation: Operation;
  timelineGroup: TimelineGroup;
  groupedTx: GroupedTransaction;
  timelineFilter: TimelineFilter;
  nft: Nft;
  governanceProps: GovernanceDashboardProps;
  governanceProposal: GovernanceProposal;
  proposalStatus: ProposalStatus;
  voteChoice: VoteChoice;
};

// ─── Circular dependency detection ─────────────────────────────────────────
//
// Walks every .ts/.tsx file under src/components and src/context (component
// files and context providers — the two places a cycle has actually broken
// builds before: a component importing a provider that itself imports a
// component), parses each with the TypeScript compiler API, and follows its
// relative imports to build a directed graph. Depth-first search over that
// graph reports every cycle found, each as the file path sequence that forms
// it (A -> B -> A), so a failure points directly at the files to break apart.
//
// Deliberately AST-based rather than a text/regex scan over import
// statements: a regex misses re-exports (`export { X } from "./y"`, which
// creates the same dependency edge as an import) and would need its own
// ad-hoc handling of multi-line import statements, template-literal-ish
// edge cases, and comments containing the word "import". The compiler API
// already parses all of that correctly as part of parsing the file once for
// its own purpose.

const SRC_DIR = resolve(dirname(new URL(import.meta.url).pathname), ".");
const WALKED_DIRS = ["components", "context"];
const SOURCE_EXTENSIONS = [".ts", ".tsx"];

/** Every `.ts`/`.tsx` file under `dir`, recursively, as absolute paths. */
function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

/** The relative import/re-export specifiers a file's AST actually contains. */
function relativeImportsOf(filePath: string): string[] {
  const source = readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const specifiers: string[] = [];
  function visit(node: ts.Node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const text = node.moduleSpecifier.text;
      if (text.startsWith(".")) {
        specifiers.push(text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}

/** Resolves a relative import specifier to one of `knownFiles`, if any. */
function resolveImport(
  fromFile: string,
  specifier: string,
  knownFiles: Set<string>,
): string | null {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (knownFiles.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Every import cycle among the `.ts`/`.tsx` files under
 * `src/components` and `src/context`, each reported as the sequence of
 * file paths (relative to `src/`) that forms it.
 *
 * Returns an empty array when there are none.
 */
export function findCircularDependencies(): string[][] {
  const roots = WALKED_DIRS.map((d) => join(SRC_DIR, d));
  const files = roots.flatMap(listSourceFiles);
  const knownFiles = new Set(files);

  const graph = new Map<string, string[]>();
  for (const file of files) {
    const edges = relativeImportsOf(file)
      .map((specifier) => resolveImport(file, specifier, knownFiles))
      .filter((resolved): resolved is string => resolved !== null);
    graph.set(file, edges);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  function visit(node: string) {
    if (onStack.has(node)) {
      const cycleStart = stack.indexOf(node);
      cycles.push(
        [...stack.slice(cycleStart), node].map((f) => relative(SRC_DIR, f)),
      );
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node) ?? []) {
      visit(next);
    }
    stack.pop();
    onStack.delete(node);
  }

  for (const file of files) {
    visit(file);
  }

  return cycles;
}
