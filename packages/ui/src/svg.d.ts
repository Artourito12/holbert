// Complète la déclaration de vite-plugin-svgr/client : Heldert importe les
// icônes via l'export nommé `ReactComponent` (svgr exportType: "named").
declare module "*.svg?react" {
  import * as React from "react";
  export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;
}
