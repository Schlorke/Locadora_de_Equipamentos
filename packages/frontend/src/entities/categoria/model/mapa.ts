export const CATEGORY_PAGE_SIZE = 9;

export interface CategoryDialogDesignInput {
  backgroundColor: string;
  fontColor: string;
  iconColor: string;
  icon: string;
  customIcon: { source: string };
  placement: string;
}

export interface CategoryDialogDataInput {
  id?: string;
  name: string;
  description?: string;
  design: {
    backgroundColor: string;
    fontColor: string;
    iconColor: string;
    icon?: string | null;
    placement?: string | null;
    customIcon: { source: string };
  };
}

export interface CategoryRecordInput {
  id: string;
  name: string;
  description?: string;
  icon?: string | null;
  iconColor?: string;
  backgroundColor?: string;
  fontColor?: string;
  placement?: string | null;
  customIcon?: { source: string } | string | null;
  bgColor?: string;
}

export function categoryToDialogCategoryData(
  category: CategoryRecordInput,
  defaults: CategoryDialogDesignInput,
): {
  id: string;
  name: string;
  description: string;
  design: CategoryDialogDesignInput;
} {
  let customIcon = { ...defaults.customIcon };
  if (category.customIcon) {
    try {
      const parsed =
        typeof category.customIcon === "string" ? JSON.parse(category.customIcon) : category.customIcon;
      customIcon = parsed;
    } catch {
      customIcon = { ...defaults.customIcon };
    }
  }

  return {
    id: category.id,
    name: category.name,
    description: category.description || "",
    design: {
      backgroundColor: category.backgroundColor || category.bgColor || defaults.backgroundColor,
      fontColor: category.fontColor || defaults.fontColor,
      iconColor: category.iconColor || defaults.iconColor,
      icon: category.icon || defaults.icon,
      customIcon,
      placement: category.placement || defaults.placement,
    },
  };
}

export function dialogCategoryDataToApiPayload(data: CategoryDialogDataInput) {
  return {
    name: data.name,
    description: data.description,
    bgColor: data.design.backgroundColor,
    backgroundColor: data.design.backgroundColor,
    fontColor: data.design.fontColor,
    iconColor: data.design.iconColor,
    icon: data.design.customIcon.source === "none" ? data.design.icon || null : null,
    placement: data.design.placement || null,
    customIcon: data.design.customIcon.source !== "none" ? data.design.customIcon : null,
  };
}
