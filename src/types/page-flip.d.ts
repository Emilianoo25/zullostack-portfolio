// Tipos mínimos para page-flip (StPageFlip) — el paquete no trae .d.ts publicados.
declare module 'page-flip/dist/js/page-flip.module.js' {
  export type Orientation = 'portrait' | 'landscape';
  export type FlippingState = 'user_fold' | 'fold_corner' | 'flipping' | 'read';
  export type FlipCorner = 'top' | 'bottom';

  export interface FlipSetting {
    startPage?: number;
    size?: 'fixed' | 'stretch';
    width: number;
    height: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    swipeDistance?: number;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
  }

  export interface WidgetEvent<T = unknown> {
    data: T;
    object: PageFlip;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: FlipSetting);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    on(event: 'init', cb: (e: WidgetEvent<{ page: number; mode: Orientation }>) => void): this;
    on(event: 'flip', cb: (e: WidgetEvent<number>) => void): this;
    on(event: 'changeOrientation', cb: (e: WidgetEvent<Orientation>) => void): this;
    on(event: 'changeState', cb: (e: WidgetEvent<FlippingState>) => void): this;
    off(event: string): void;
    flip(page: number, corner?: FlipCorner): void;
    flipNext(corner?: FlipCorner): void;
    flipPrev(corner?: FlipCorner): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    getOrientation(): Orientation;
    getState(): FlippingState;
    update(): void;
    destroy(): void;
  }
}
