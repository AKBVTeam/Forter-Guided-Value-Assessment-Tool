-- Create saved_analyses table
CREATE TABLE public.saved_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  author_name TEXT,
  customer_name TEXT,
  data JSONB NOT NULL,
  customer_logo_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own analyses
CREATE POLICY "Users can view own analyses"
ON public.saved_analyses
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can view public analyses
CREATE POLICY "Anyone can view public analyses"
ON public.saved_analyses
FOR SELECT
USING (is_public = true);

-- Policy: Users can create their own analyses
CREATE POLICY "Users can create own analyses"
ON public.saved_analyses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own analyses
CREATE POLICY "Users can update own analyses"
ON public.saved_analyses
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own analyses
CREATE POLICY "Users can delete own analyses"
ON public.saved_analyses
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_saved_analyses_updated_at
BEFORE UPDATE ON public.saved_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_saved_analyses_user_id ON public.saved_analyses(user_id);
CREATE INDEX idx_saved_analyses_is_public ON public.saved_analyses(is_public) WHERE is_public = true;