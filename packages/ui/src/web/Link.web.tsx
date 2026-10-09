'use client'
import NextLink from 'next/link'
import {forwardRef,type ComponentProps} from 'react'
import {useResolvedHref} from '../contract/navigation'
export const Link=forwardRef<HTMLAnchorElement,ComponentProps<typeof NextLink>>(function Link({href,...props},ref){const resolved=useResolvedHref(typeof href==='string'?href:'');return <NextLink ref={ref} href={typeof href==='string'?resolved:href} {...props}/>})
