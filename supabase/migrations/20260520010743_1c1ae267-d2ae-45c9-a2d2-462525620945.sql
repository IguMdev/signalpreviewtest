
UPDATE public.user_engagement_subscriptions
   SET status = 'canceled',
       updated_at = now()
 WHERE user_id = 'bbdb040e-ea86-4744-829c-d5211b2c4895'
   AND status = 'active';
