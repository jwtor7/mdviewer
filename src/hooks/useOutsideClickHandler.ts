/**
 * useOutsideClickHandler Hook
 *
 * Generic hook for closing menus/panels when clicking outside them.
 * Attaches a mousedown listener when isOpen is true and removes it
 * when the component is closed or unmounted.
 */

import { useEffect, type RefObject } from 'react';

export interface UseOutsideClickHandlerProps<T extends HTMLElement> {
  ref: RefObject<T | null>;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Hook to detect clicks outside a referenced element and trigger a close action.
 *
 * @param ref - React ref to the element to monitor
 * @param isOpen - Whether the element is currently open/visible
 * @param onClose - Callback to execute when an outside click is detected
 *
 * @example
 * ```tsx
 * const menuRef = useRef<HTMLDivElement>(null);
 * const [showMenu, setShowMenu] = useState(false);
 *
 * useOutsideClickHandler({
 *   ref: menuRef,
 *   isOpen: showMenu,
 *   onClose: () => setShowMenu(false)
 * });
 * ```
 */
export const useOutsideClickHandler = <T extends HTMLElement>({
  ref,
  isOpen,
  onClose,
}: UseOutsideClickHandlerProps<T>): void => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, isOpen, onClose]);
};

export default useOutsideClickHandler;
