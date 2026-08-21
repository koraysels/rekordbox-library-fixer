// The package ships typings but its "exports" map hides them from tsc, so the
// import resolves to an implicit any. Re-point it at the bundled declarations.
declare module 'better-sqlite3-multiple-ciphers' {
  import Database from 'better-sqlite3';
  export = Database;
}
