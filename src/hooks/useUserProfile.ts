import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { fetchUserProfile } from "../services/userProfile.service";

/** True only for the signed-in user whose Firestore `users/{uid}` doc has `isAdmin: true`. */
export const useIsOwner = (): boolean => {
  const { currentUser } = useAuth();
  const { data } = useQuery({
    queryKey: ["userProfile", currentUser?.uid],
    queryFn: () => fetchUserProfile(currentUser!.uid),
    enabled: !!currentUser,
  });
  return !!data?.isAdmin;
};
