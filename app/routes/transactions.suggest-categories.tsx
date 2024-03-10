import { useNavigate, useSearchParams } from "@remix-run/react";
import { PropsWithChildren } from "react";
import { route } from "routes-gen";
import { Button } from "~/components/ui/button";
import Modal from "~/components/ui/modal";

export default function SuggestCategories({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function handleClose() {
    navigate(route("/transactions") + `?${searchParams.toString()}`);
  }

  // TODO: Implement the save button
  const saveButton = <Button onClick={() => console.log("Save")}>Save</Button>;

  return (
    <Modal
      title="Suggest Categories"
      isOpen={true}
      onClose={handleClose}
      actionButton={saveButton}
    >
      TODO
    </Modal>
  );
}
