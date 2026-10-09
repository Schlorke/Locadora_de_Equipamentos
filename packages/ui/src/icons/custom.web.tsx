import { createElement, type ReactNode } from 'react';
import { customGlyphs, type SvgNode, type CustomIconProps, type CustomIconName } from './custom-model';
export type { CustomIconProps, CustomIconName } from './custom-model';
function render(node: SvgNode | string, key?: number): ReactNode {
 if(typeof node==='string')return node;
 return createElement(node.tag,{...node.props,key},...node.children.map((child,i)=>render(child,i)));
}
function glyph(name: CustomIconName) {
 const Icon = (props: CustomIconProps) => render(customGlyphs[name](props));
 Icon.displayName=name; return Icon;
}
export const CustomIcon1=glyph('CustomIcon1');
export const CustomIcon2=glyph('CustomIcon2');
export const AndaimeSuspenso=glyph('AndaimeSuspenso');
export const AndaimeTubular=glyph('AndaimeTubular');
export const Transporte=glyph('Transporte');
export const Terraplenagem=glyph('Terraplenagem');
export const Rompedor=glyph('Rompedor');
export const Compressor=glyph('Compressor');
export const CadeiraEletrica=glyph('CadeiraEletrica');
export const Betoneira=glyph('Betoneira');
export const TrabalhoEmAltura=glyph('TrabalhoEmAltura');
export const Lavagem=glyph('Lavagem');
export const CUSTOM_ICONS={CustomIcon1,CustomIcon2,AndaimeSuspenso,AndaimeTubular,Transporte,Terraplenagem,Rompedor,Compressor,CadeiraEletrica,Betoneira,TrabalhoEmAltura,Lavagem};
