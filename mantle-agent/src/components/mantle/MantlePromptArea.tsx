import { useEffect } from "react";
import { PromptInputBody, PromptInputTextarea, usePromptInputController } from "../ai-elements/prompt-input";

export function MantlePromptArea({
  pendingSuggestion,
  onPendingSuggestionConsumed,
}: {
  pendingSuggestion: string | null;
  onPendingSuggestionConsumed: () => void;
}) {
  const controller = usePromptInputController();

  useEffect(() => {
    if (pendingSuggestion) {
      controller.textInput.setInput(pendingSuggestion);
      onPendingSuggestionConsumed();
    }
  }, [pendingSuggestion, controller, onPendingSuggestionConsumed]);

  return (
    <PromptInputBody>
      <PromptInputTextarea placeholder="Mantle に何でも聞いてください…" />
    </PromptInputBody>
  );
}