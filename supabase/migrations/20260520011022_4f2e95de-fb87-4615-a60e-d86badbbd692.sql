
UPDATE public.engagement_plans
   SET smm_service_id = 2637
 WHERE bot_type = 'interacoes';

DELETE FROM public.engagement_orders
 WHERE user_id = 'bbdb040e-ea86-4744-829c-d5211b2c4895';

DELETE FROM public.engagement_reaction_dispatches
 WHERE user_id = 'bbdb040e-ea86-4744-829c-d5211b2c4895';

UPDATE public.user_engagement_subscriptions
   SET status = 'active',
       units_used = 0,
       auto_dispatched_at = NULL,
       updated_at = now()
 WHERE user_id = 'bbdb040e-ea86-4744-829c-d5211b2c4895'
   AND status IN ('canceled','active');
