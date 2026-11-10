// Every kind of equipment, and how My Gym groups them.

export const EQUIP = ['barbell','dumbbells','kettlebell','ez_bar','bench','rack','pullup_bar','dip_bars','rings',
               'cable','leg_press','leg_curl','leg_ext','back_ext','bands',
               'smith','trap_bar','landmine','machine_press','pec_deck','machine_shoulder','hack_squat','hip_machine','calf_machine','ghd','box','parallettes','ab_wheel','sled',
               'plates','assist_machine','row_machine','lat_raise_m','curl_machine','tri_machine','pendulum','belt_squat','ssb','glute_machine','ab_machine','seated_calf_m','med_ball','sandbag','suspension','stability_ball','climb_rope','wrist_roller','gripper',
               'treadmill','exercise_bike','bicycle','rower','elliptical','stair_climber','ski_erg','air_bike','pool','jump_rope','battle_ropes','punch_bag','foam_roller','stretch_strap','massage_ball','stick'];

export const EQUIP_GROUPS = [
  {key:'free', items:['barbell','dumbbells','kettlebell','ez_bar','trap_bar','ssb','plates','med_ball','sandbag']},
  {key:'machine', items:['cable','smith','leg_press','leg_curl','leg_ext','machine_press','pec_deck','machine_shoulder','hack_squat','hip_machine','calf_machine','assist_machine','row_machine','lat_raise_m','curl_machine','tri_machine','pendulum','belt_squat','glute_machine','ab_machine','seated_calf_m']},
  {key:'station', items:['bench','rack','pullup_bar','dip_bars','back_ext','ghd','box','landmine','climb_rope','sled']},
  {key:'small', items:['rings','suspension','bands','parallettes','ab_wheel','stability_ball','wrist_roller','gripper']},
  {key:'cardio', items:['treadmill','exercise_bike','bicycle','rower','elliptical','stair_climber','ski_erg','air_bike','pool','jump_rope','battle_ropes','punch_bag','foam_roller','stretch_strap','massage_ball','stick']}
];
