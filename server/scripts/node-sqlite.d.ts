// Tipos mínimos de node:sqlite (Node 22.5+); el @types/node del repo es anterior.
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): {
      get(...parameters: (string | number | null)[]): Record<string, unknown> | undefined;
      all(...parameters: (string | number | null)[]): Record<string, unknown>[];
      run(...parameters: (string | number | null)[]): { changes: number | bigint };
    };
  }
}
