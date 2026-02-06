-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete profiles (needed for user deletion)
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete user roles (needed for user deletion)
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));