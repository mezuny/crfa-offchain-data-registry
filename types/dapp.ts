/**
 * CRFA Offchain Data Registry - TypeScript Type Definitions
 *
 * These types define the structure for dApp entries in the registry.
 */

/** Script purpose - what the script is used for */
export type ScriptPurpose = 'SPEND' | 'MINT' | 'MANAGE' | 'STAKE' | 'WITHDRAW/PUBLISH/VOTE' | 'SPEND/MINT';

/** Script type - the underlying technology */
export type ScriptType = 'PLUTUS' | 'NATIVE' | 'TIMELOCK';

/** Plutus version - which version of the Plutus VM */
export type PlutusVersion = 1 | 2 | 3;

/** dApp category */
export type Category =
  | 'DEFI'
  | 'MARKETPLACE'
  | 'COLLECTION'
  | 'GAMING'
  | 'COMMUNITY'
  | 'TOKEN_DISTRIBUTION'
  | 'STABLECOIN'
  | 'MOBILE_NETWORK'
  | 'GENERIC'
  | 'SMART_WALLET'
  | 'LAYER_2'
  | 'BLOCKCHAIN'
  | 'NFT_MINTING_PLATFORM'
  | 'UNKNOWN';

/** dApp sub-category */
export type SubCategory =
  | 'AMM_DEX'
  | 'ORDERBOOK_DEX'
  | 'HYBRID_DEX'
  | 'LENDING_BORROWING'
  | 'NFT'
  | 'ORACLE'
  | 'WRAPPED_ASSETS'
  | 'DEX'
  | 'CHARITY'
  | 'STAKING'
  | 'PERPETUALS'
  | 'LAUNCHPAD'
  | 'DEX_AGGREGATOR'
  | 'MINING'
  | 'CONCENTRATED_LIQUIDITY_DEX'
  | 'SYNTHETICS'
  | 'OPTION'
  | 'STEALTH_WALLET'
  | 'UNKNOWN';

/** Script entry - represents a single smart contract */
export interface Script {
  /** Unique 8-character alphanumeric ID (deterministic from scriptHash) */
  id: string;

  /** Human-readable name for the script */
  name: string;

  /** What the script is used for */
  purpose: ScriptPurpose;

  /** Script technology type */
  type: ScriptType;

  /** Script hash (payment credential) - 56 hex characters */
  scriptHash: string;

  /** Full script hash with network prefix (71 for mainnet) - 58 hex characters */
  fullScriptHash: string;

  /** Plutus version (1, 2, or 3) - required for PLUTUS type scripts */
  plutusVersion: PlutusVersion;

  /** Protocol version (2, 3, etc.) - omit for V1 (implied default) */
  protocolVersion?: number;

  // TODO: Add contractAddress derivation helper
  // /** Bech32 encoded contract address */
  // contractAddress?: string;

  // TODO: Add mintPolicyID support
  // /** Mint policy ID - for MINT purpose scripts */
  // mintPolicyID?: string;
}

/** dApp description */
export interface Description {
  /** Short description */
  short: string;
}

/** Main dApp entry - the root structure for each project */
export interface DApp {
  /** Unique 8-character alphanumeric ID (deterministic from project name) */
  id: string;

  /** Project name */
  projectName: string;

  /** All scripts associated with this dApp */
  scripts: Script[];

  /** Project main page link */
  link?: string;

  /** Twitter/X profile link */
  twitter?: string;

  /** Main category */
  category?: Category;

  /** Sub-category */
  subCategory?: SubCategory;

  /** Description */
  description?: Description;

  // TODO: Revisit these fields - commented out for now
  // /** Features list */
  // features?: string[];

  // /** Release groupings (optional - for complex projects) */
  // releases?: Release[];

  // /** Audit information */
  // audits?: Audit[];

  // /** Open source contract information */
  // contracts?: Contract[];
}

// =============================================================================
// TODO: Revisit these types when re-adding features, releases, audits, contracts
// =============================================================================

// /** Audit information */
// export interface Audit {
//   /** Unique 4-character audit ID */
//   auditId: string;
//
//   /** Auditor company name */
//   auditor: string;
//
//   /** Link to audit report */
//   auditLink: string;
//
//   /** Type of audit */
//   auditType: 'MANUAL' | 'AUTOMATIC';
// }

// /** Open source contract information */
// export interface Contract {
//   /** Whether contracts are open source */
//   openSource: boolean;
//
//   /** Link to source code */
//   contractLink?: string;
//
//   /** Unique 4-character contract ID */
//   contractId?: string;
// }

// /** Release information - grouping of scripts by release */
// export interface Release {
//   /** Release number */
//   releaseNumber: number;
//
//   /** Release name (e.g., "V1", "V2") */
//   releaseName: string;
//
//   /** Description of the release */
//   description?: string;
//
//   /** Scripts included in this release (by id and version) */
//   scripts: Array<{
//     id: string;
//     version: number;
//   }>;
//
//   /** Associated audit ID */
//   auditId?: string;
//
//   /** Associated contract ID */
//   contractId?: string;
// }
