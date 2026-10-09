import { createElement, type ReactNode, type ElementType } from 'react';
import Svg, { Path, Circle, Rect, Line, Polygon, Polyline, Ellipse, G, Defs, ClipPath } from 'react-native-svg';
import { customGlyphs, type SvgNode, type CustomIconProps, type CustomIconName } from './custom-model';
import { useTheme } from '../theme/ThemeProvider';
export type { CustomIconProps, CustomIconName } from './custom-model';
const elements: Record<string,ElementType>={svg:Svg,path:Path,circle:Circle,rect:Rect,line:Line,polygon:Polygon,polyline:Polyline,ellipse:Ellipse,g:G,defs:Defs,clipPath:ClipPath};
function render(node: SvgNode | string, key?: number): ReactNode {
 if(typeof node==='string'||node.tag==='title')return null;
 const Element=elements[node.tag]; if(!Element)throw new Error('Unsupported SVG element: '+node.tag);
 const {className:_className,xmlns:_xmlns,...props}=node.props;
 const title=node.children.find(child=>typeof child!=='string'&&child.tag==='title');
 return createElement(Element,{...props,key,...(title&&typeof title!=='string'?{accessibilityLabel:title.children.join('')}: {})},...node.children.map((child,i)=>render(child,i)));
}
function glyph(name: CustomIconName) {
 const Icon = (props: CustomIconProps) => {const theme=useTheme();return render(customGlyphs[name]({...props,color:!props.color||props.color==='currentColor'?theme.text:props.color}));};
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
