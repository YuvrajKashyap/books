// True when this browser holds a stored owner session. It may have expired.
export function sessionMayExist() {
  try {
    return Object.keys(localStorage).some((key) =>
      /^sb-.+-auth-token$/.test(key),
    );
  } catch {
    return true;
  }
}
