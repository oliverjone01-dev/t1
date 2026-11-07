import React from 'react';
import {clsx} from 'clsx';
import {twMerge} from 'tailwind-merge';
export const cn=(...args:any[])=>twMerge(clsx(args));
export const Button=React.forwardRef<HTMLButtonElement,any>((p,r)=><button ref={r} {...p}/>);
export const Card=React.forwardRef<HTMLDivElement,any>((p,r)=><div ref={r} {...p}/>);
