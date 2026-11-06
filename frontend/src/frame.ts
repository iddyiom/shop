// What a page's header row needs from the frame (Layout.tsx): the menu state and its buttons.
// There is no top bar (R1 spec, section 11), so the menu button lives in each page's header.
import { createContext, useContext } from 'react';

export type Frame = {
  collapsed: boolean; // laptop: the menu is an icon rail
  drawerOpen: boolean; // phone: the menu has popped up
  toggleCollapsed: () => void;
  openDrawer: () => void;
};

const NO_FRAME: Frame = {
  collapsed: false,
  drawerOpen: false,
  toggleCollapsed: () => {},
  openDrawer: () => {},
};

export const FrameContext = createContext<Frame>(NO_FRAME);

export function useFrame(): Frame {
  return useContext(FrameContext);
}
