import { MANTLE_BLUE, SUGGESTIONS } from "@/utils/constants";
import { Suggestion, Suggestions } from "../ai-elements/suggestion";

export function MantleEmptyState({
  onSuggestionClick,
}: {
  onSuggestionClick: (s: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className="flex size-14 items-center justify-center rounded-2xl text-2xl font-bold"
          style={{
            background: `linear-gradient(135deg, ${MANTLE_BLUE}20, ${MANTLE_BLUE}08)`,
            border: `1px solid ${MANTLE_BLUE}30`,
            color: MANTLE_BLUE,
          }}
        >
          M
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: MANTLE_BLUE }}>
            Mantle AI Agent
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DeFi・コントラクト・ポートフォリオ分析・デバッグ
          </p>
        </div>
      </div>
      <div className="w-full max-w-xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          試してみる
        </p>
        <Suggestions className="flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <Suggestion
              key={s}
              suggestion={s}
              onClick={onSuggestionClick}
              className="text-xs"
            />
          ))}
        </Suggestions>
      </div>
    </div>
  );
}