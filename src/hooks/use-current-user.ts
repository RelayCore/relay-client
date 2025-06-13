import { useMembers } from "@/contexts/server-context";
import { useParams } from "@tanstack/react-router";

export function useCurrentUser() {
    const { userId } = useParams({ strict: false });
    const { users } = useMembers();

    const currentUser = userId
        ? users.find((user) => user.id === userId)
        : undefined;

    return { currentUser, userId };
}
