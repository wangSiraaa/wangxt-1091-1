declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: any[]): Database;
    exec(sql: string, params?: any[]): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
    create_function(name: string, func: (...args: any[]) => any): Database;
  }

  export class Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getColumnNames(): string[];
    getAsObject(): Record<string, any>;
    get(params?: any[]): any[];
    reset(): void;
    free(): boolean;
    run(params?: any[]): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
