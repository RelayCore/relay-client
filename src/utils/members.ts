import { Role, User } from "@/api/server";

export function getHighestRole(user: User): Role | null {
    const highestRole = [...user.roles]
        .filter((role) => role.display_role_members !== false)
        .sort((a, b) => b.rank - a.rank);

    return highestRole[0] || null;
}

export function getHighestColoredRole(user: User): Role | null {
    const highestColoredRole = [...user.roles]
        .filter((role) => role.display_role_members !== false)
        .sort((a, b) => b.rank - a.rank)
        .find((role) => role.color);

    return highestColoredRole || null;
}
