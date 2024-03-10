import { PropsWithChildren, ReactNode } from "react";
import { Button } from "./button";

type ModalProps = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  actionButton?: ReactNode;
};

export default function Modal({
  children,
  title,
  isOpen,
  onClose,
  actionButton,
}: PropsWithChildren<ModalProps>) {
  if (!isOpen) return null;

  return (
    <div>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed left-0 top-0 z-20 flex h-full w-full items-center justify-center "
      >
        <div className="absolute h-full w-full bg-gray-900 opacity-50" />
        <div className="max-h-3/4 z-50 mx-auto flex w-11/12 flex-col rounded bg-white px-8 py-6 text-left shadow-lg">
          <div className="flex items-center justify-between pb-3">
            <p className="text-2xl font-bold">{title}</p>
            <div className="z-50 cursor-pointer" onClick={onClose}>
              <svg
                className="fill-current text-black"
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 18 18"
              >
                <path d="M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z"></path>
              </svg>
            </div>
          </div>
          <div className="overflow-y-auto">{children}</div>
          <div className="mt-auto flex justify-end gap-2 pt-4">
            <Button onClick={onClose} variant="ghost">
              Cancel
            </Button>
            {actionButton}
          </div>
        </div>
      </div>
    </div>
  );
}
