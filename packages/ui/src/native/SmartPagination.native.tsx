import { Text, View } from "react-native";
import { space } from "@gb-locacoes/design-tokens";
import { smartPaginationWindow } from "../web/smart-pagination";
import { Button } from "./Button.native";
import { useTheme } from "../theme/ThemeProvider";
export function SmartPagination({ currentPage, totalPages, onPageChange, showPageNumbers = 5 }: {
  currentPage: number; totalPages: number; onPageChange?: (page: number) => void; showPageNumbers?: number;
}) {
  const pageWindow = smartPaginationWindow(currentPage, totalPages, showPageNumbers);
  const theme = useTheme();
  if (!pageWindow) return null;
  return <View style={{gap:space.sm}}>
    <Text accessibilityLiveRegion="polite" style={{color:theme.text}}>Página {currentPage} de {totalPages}</Text>
    <View style={{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:space.xs}}>
      <Button variant="outline" disabled={!pageWindow.canGoPrev || !onPageChange} onClick={() => onPageChange?.(currentPage-1)}>Anterior</Button>
      {pageWindow.showLeftEllipsis ? <Text style={{color:theme.text}}>…</Text> : null}
      {pageWindow.visiblePages.map(page => <Button key={page} variant={page===currentPage?"default":"outline"} disabled={!onPageChange || page===currentPage} onClick={() => onPageChange?.(page)}>{page}</Button>)}
      {pageWindow.showRightEllipsis ? <Text style={{color:theme.text}}>…</Text> : null}
      <Button variant="outline" disabled={!pageWindow.canGoNext || !onPageChange} onClick={() => onPageChange?.(currentPage+1)}>Próxima</Button>
    </View>
  </View>;
}
