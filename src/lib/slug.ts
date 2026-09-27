export const teamSlug = (team: string) => team.toLowerCase().replace(/[^a-z0-9]+/g, "-");
