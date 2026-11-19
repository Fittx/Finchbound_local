import { Book } from "./Book.js";
import { Page } from "./Page.js";
export async function initializeBookModels() {
  await Promise.all([Book.createIndexes(), Page.createIndexes()]);
}
