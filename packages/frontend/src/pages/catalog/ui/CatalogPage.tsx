"use client";
import { useState } from "react";
import { Button, Stack, Text, catalog, type CatalogRecipeId } from "@gb-locacoes/ui";
import { CatalogRecipe } from "./CatalogRecipe";

/** One product catalog, using the host's platform implementation of each primitive. */
export function CatalogPage() {
 const [recipe,setRecipe]=useState<CatalogRecipeId>("Button");
 const [state,setState]=useState<string>(catalog.Button.states[0]);
 const entry=catalog[recipe];
 return <Stack padding="xl" gap="lg">
  <Text heading={1} size="xl">Catálogo de componentes</Text>
  <Text tone="muted">Selecione uma composição e um estado. As partes são demonstradas dentro de seus componentes.</Text>
  <Stack direction="row" gap="sm">{Object.entries(catalog).map(([id,item])=><Button key={id} variant={recipe===id?"default":"outline"} onClick={()=>{setRecipe(id as CatalogRecipeId);setState(item.states[0]);}}>{item.title}</Button>)}</Stack>
  <Text heading={2} size="lg">{entry.title}</Text>
  <Text size="sm" tone="muted">{entry.members.join(", ")}</Text>
  <Stack direction="row" gap="sm">{entry.states.map(name=><Button key={name} variant={state===name?"default":"outline"} onClick={()=>setState(name)}>{name}</Button>)}</Stack>
  <Text>{`${recipe} / ${state}`}</Text>
  <Stack surface padding="md"><CatalogRecipe key={`${recipe}:${state}`} recipe={recipe} state={state}/></Stack>
 </Stack>;
}
