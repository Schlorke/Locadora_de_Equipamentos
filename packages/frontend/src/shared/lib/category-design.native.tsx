import { typography } from '@gb-locacoes/design-tokens';
import { Text } from 'react-native';
import { SvgXml, SvgUri } from 'react-native-svg';
import { Tag } from 'lucide-react-native';
import { renderIcon } from './constants/all-icons';
import { normalizeIconName } from './icon-utils';
import { DEFAULT_ICON, type CategoryDesign, type RenderIconOptions } from './category-design-model';
export { MAX_SVG_FILE_SIZE_KB, DEFAULT_ICON, DEFAULT_CUSTOM_ICON, DEFAULT_DESIGN, CATEGORY_PREVIEW_TABS, cloneDesign, sanitizeSvg, isValidSvgFile, isValidSvgUrl } from './category-design-model';
export type { CategoryDialogMode, CategoryPlacement, CustomIconSource, CustomIconConfig, CategoryDetails, CategoryDesign, RenderIconOptions } from './category-design-model';

export function svgToDataUrl(svg: string): string { return svg ? 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) : ''; }
export function renderCategoryIcon(design: CategoryDesign, {size=28,color}: RenderIconOptions={}) {
 const custom=design.customIcon;
 if(custom.source==='upload' && custom.svgContent)return <SvgXml xml={custom.svgContent} width={size} height={size} />;
 if(custom.source==='upload' && custom.dataUrl)return <SvgUri uri={custom.dataUrl} width={size} height={size} />;
 if(custom.source==='url' && custom.url)return <SvgUri uri={custom.url} width={size} height={size} />;
 if(custom.source==='emoji'&&custom.emoji)return <Text accessible={false} style={{fontSize:size*typography.scale.categoryIconText,lineHeight:size}}>{custom.emoji}</Text>;
 const iconColor=color??design.iconColor;
 return renderIcon(normalizeIconName(design.icon)??DEFAULT_ICON,size,iconColor)??<Tag size={size} color={iconColor} />;
}
