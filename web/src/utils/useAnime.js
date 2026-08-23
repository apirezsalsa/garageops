import { useEffect, useRef } from 'react';
import { createScope } from 'animejs';

// Ejecuta `setup(rootNode)` con animejs dentro de un scope ligado al ciclo de
// vida de React: se crea al montar y se revierte (cleanup automático de
// todas las animaciones) al desmontar. `rootNode` sirve para recorrer
// elementos con valores propios (p.ej. contadores). `deps` sigue las reglas
// normales de useEffect.
export function useAnimeScope(setup, deps = []) {
  const rootRef = useRef(null);
  const scopeRef = useRef(null);

  useEffect(() => {
    scopeRef.current = createScope({ root: rootRef }).add(() => setup(rootRef.current));
    return () => scopeRef.current?.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return rootRef;
}
