/**
 * The display names of operator accounts, for the public "who ran the draw"
 * line of a live draw. It answers names only: never an email, phone or DNI.
 */
export interface OperatorDirectory {
  /**
   * The stored account name of each id found, exactly as stored (it may be
   * empty or null). Ids that match no account are absent from the map.
   */
  displayNamesOf(operatorIds: string[]): Promise<Map<string, string | null>>;
}
