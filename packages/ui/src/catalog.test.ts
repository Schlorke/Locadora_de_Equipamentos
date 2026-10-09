import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { catalog, catalogInfrastructure } from "./catalog";
function runtimeExports(platform: "web" | "native") {
 const file=ts.createSourceFile("index.ts",readFileSync(resolve(`packages/ui/src/index.${platform}.ts`),"utf8"),ts.ScriptTarget.Latest,true);
 return file.statements.flatMap(statement=>ts.isExportDeclaration(statement) && !statement.isTypeOnly && statement.exportClause && ts.isNamedExports(statement.exportClause) ? statement.exportClause.elements.filter(item=>!item.isTypeOnly).map(item=>item.name.text):[]);
}
describe("semantic component catalog",()=>{
 for(const platform of ["web","native"] as const) it(`classifies every ${platform} runtime export exactly once`,()=>{
  const members=Object.values(catalog).flatMap(recipe=>[...recipe.members]);
  expect(new Set(members).size).toBe(members.length);
  const assigned=new Set([...members,...Object.keys(catalogInfrastructure)]);
  expect(runtimeExports(platform).filter(name=>!assigned.has(name))).toEqual([]);
 });
 it("all recipes own real components with explicit states",()=>{
  const exported=new Set([...runtimeExports("web"),...runtimeExports("native")]);
  for(const recipe of Object.values(catalog)) {
   expect(recipe.members.length).toBeGreaterThan(0);
   expect(recipe.states.length).toBeGreaterThan(0);
   expect(new Set(recipe.states).size).toBe(recipe.states.length);
   for(const member of recipe.members) expect(exported.has(member),member).toBe(true);
  }
 });
 it("classifies hooks, constants and style generators without mistaking capitalization for components",()=>{
  expect(catalogInfrastructure.CUSTOM_ICONS).toBe("custom");
  expect(catalogInfrastructure.useFormField).toBe("Form");
  // Hook do contrato de navegação (web e nativo): pertence à família do NavigationProvider, não é componente.
  expect(catalogInfrastructure.useNavigate).toBe("navigation");
  expect(catalog.navigation.members).toContain("NavigationProvider");
  expect(catalog.Card.members).toContain("CardHeader");
  expect(catalog.Card.members).toContain("CardFooter");
  expect(Object.keys(catalog)).not.toContain("CardHeader");
 });
});
