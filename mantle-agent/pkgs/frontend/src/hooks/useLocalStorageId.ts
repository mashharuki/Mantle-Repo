import { nanoid } from "nanoid";
import { useState } from "react";

/**
 * localStorage にキーが存在しなければ nanoid で生成し、永続化して返すカスタムフック。
 * useState の lazy initializer で初回マウント時に一度だけ読み書きする。
 * SSR 環境（window が未定義）では空文字を返す。
 */
export function useLocalStorageId(key: string): string {
	const [id] = useState<string>(() => {
		if (typeof window === "undefined") return "";
		const stored = localStorage.getItem(key);
		if (stored) return stored;
		const newId = nanoid();
		localStorage.setItem(key, newId);
		return newId;
	});

	return id;
}
