'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import React from 'react'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type { AdminCardProps } from './contract';
import type { AdminCardProps } from './contract';

export function AdminCard({
  children,
  title,
  subtitle,
  icon,
  className,
  contentClassName,
  variant = 'default',
}: AdminCardProps) {
  const cardVariants = {
    default:
      'relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300 h-full hover:scale-[1.02]',
    elevated:
      'relative overflow-hidden border-0 shadow-2xl bg-white backdrop-blur-sm hover:shadow-3xl transition-all duration-300 h-full hover:scale-[1.03]',
    glass:
      'relative overflow-hidden border border-white/20 bg-white/10 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300 h-full hover:scale-[1.02]',
    flat: 'relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm transition-all duration-200 h-full', // sem hover scale
  }

  return (
    <Card className={cn(cardVariants[variant], className)}>
      {/* Depth layers for glass effect */}
      {variant === 'default' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>
        </>
      )}

      {/* Header */}
      {(title || subtitle || icon) && (
        <CardHeader className="relative z-10 pb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-lg">
                {icon}
              </div>
            )}
            <div className="flex-1">
              {title && (
                <CardTitle className="text-lg font-semibold text-gray-900">
                  {title}
                </CardTitle>
              )}
              {subtitle && (
                <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
              )}
            </div>
          </div>
        </CardHeader>
      )}

      {/* Content */}
      <CardContent
        className={cn(
          'relative z-10',
          !title && !subtitle && !icon && 'p-6',
          contentClassName
        )}
      >
        {children}
      </CardContent>
    </Card>
  )
}
