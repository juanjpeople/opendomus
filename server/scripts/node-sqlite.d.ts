// Tipos mínimos de node:sqlite (Node 22.5+); el @types/node del repo es anterior.
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
  }
}
