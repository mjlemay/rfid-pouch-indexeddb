import { useEffect } from "react";
import { Appearance } from "../../utils/themes";

// Pushes the chosen title into the browser tab and the chosen theme onto the
// html element, where globals.css picks it up through the data-theme attribute.
export function useApplyAppearance({ title, theme }: Appearance) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
}
