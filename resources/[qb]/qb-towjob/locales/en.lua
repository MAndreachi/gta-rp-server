local Translations = {
    error = {
        finish_work = "Finish all of your work first",
        vehicle_not_correct = "This is not the right Vehicle",
        failed = "You have failed",
        not_towing_vehicle = "You must be In your Towing Vehicle",
        too_far_away = "You are too far away",
        no_work_done = "You have not done any work yet",
        no_deposit = "$%{value} Deposit required",
        job = "You must be a tow truck driver",
        no_truck = "You don't have a truck to return",
        already_have_truck = "You already have a truck out. Return it first or continue working.",
    },
    success = {
        paid_with_cash = "$%{value} Deposit Paid With Cash",
        paid_with_bank = "$%{value} Deposit Paid From Bank",
        refund_to_cash = "$%{value} Deposit Paid With Cash",
        you_earned = "You Earned $%{value}",
        truck_returned = "Truck returned and deposit refunded",
    },
    menu = {
        header = "Towing Job",
        close_menu = "⬅ Close Menu",
        collect = "Collect Payslip",
        return_collect = "Get paid for your work",
        start_job = "Start Job",
        start_job_desc = "Get a flatbed and start towing vehicles",
        return_truck = "Return Truck",
        return_truck_desc = "Return the flatbed and get your deposit back",
    },
    mission = {
        delivered_vehicle = "You Have Delivered A Vehicle",
        get_new_vehicle = "New contract assigned! Continue towing vehicles to earn more",
        towing_vehicle = "Hoisting the Vehicle...",
        goto_depot = "Take The Vehicle To Hayes Depot",
        vehicle_towed = "Vehicle Towed",
        untowing_vehicle = "Remove The Vehicle",
        vehicle_takenoff = "Vehicle Taken Off",
    },
    info = {
        tow = "Place A Car On The Back Of Your Flatbed",
        toggle_npc = "Toggle Npc Job",
        skick = "Attempted exploit abuse",
        talk = "Press [E] to talk",
    },
    label = {
        payslip = "Payslip",
        vehicle = "Vehicle",
        npcz = "NPCZone",
    },
    target = {
        talk = "Talk",
    },
    xp = {
        gained = "+%{xp} XP (Total: %{total})",
        condition_bonus = "+%{value} XP (Perfect Condition)",
        time_bonus = "+%{value} XP (Quick Delivery)",
        level_up = "Level Up! You are now Level %{level} (%{label})",
    }
}

Lang = Lang or Locale:new({
    phrases = Translations,
    warnOnMissing = true
})
