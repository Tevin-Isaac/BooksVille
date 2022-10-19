from pyteal import *


class Book:
    class Variables:
        name = Bytes("NAME")
        image = Bytes("IMAGE")
        description = Bytes("DESCRIPTION")
        price = Bytes("PRICE")
        sold = Bytes("SOLD")
        likes = Bytes("LIKES")  # Uint64
        dislikes = Bytes("DISLIKES")  # Uint64
        address = Bytes("ADDRESS")
        owner = Bytes("OWNER")

    class AppMethods:
        like = Bytes("like")
        dislike = Bytes("dislike")
        buy = Bytes("buy")

    def application_creation(self):
        return Seq([
            Assert(Txn.application_args.length() == Int(4)),
            Assert(Txn.note() == Bytes("books:uv1")),
            Assert(Btoi(Txn.application_args[3]) > Int(0)),
            App.globalPut(self.Variables.name, Txn.application_args[0]),
            App.globalPut(self.Variables.image, Txn.application_args[1]),
            App.globalPut(self.Variables.description, Txn.application_args[2]),
            App.globalPut(self.Variables.price, Btoi(Txn.application_args[3])),
            App.globalPut(self.Variables.sold, Int(0)),
            App.globalPut(self.Variables.likes, Int(0)),
            App.globalPut(self.Variables.dislikes, Int(0)),
            App.globalPut(self.Variables.address, Global.creator_address()),
            App.globalPut(self.Variables.owner, Txn.application_args[1]),
            Approve()
        ])

    def buy(self):
        count = Txn.application_args[1]
        valid_number_of_transactions = Global.group_size() == Int(2)

        valid_payment_to_seller = And(
            Gtxn[1].type_enum() == TxnType.Payment,
            Gtxn[1].receiver() == Global.creator_address(),
            Gtxn[1].amount() == App.globalGet(self.Variables.price) * Btoi(count),
            Gtxn[1].sender() == Gtxn[0].sender(),
        )

        can_buy = And(valid_number_of_transactions,
                      valid_payment_to_seller)

        update_state = Seq([
            App.globalPut(self.Variables.sold, App.globalGet(self.Variables.sold) + Btoi(count)),
            Approve()
        ])

        return If(can_buy).Then(update_state).Else(Reject())

    # like
    def like(self):

        Assert(
            And(
                    # The number of transactions within the group transaction must be exactly 2.
                    # first one being the adopt function and the second being the payment transactions
                    Global.group_size() == Int(1),

                    # Txn.applications[0] is a special index denoting the current app being interacted with
                    Txn.applications.length() == Int(1),

                    # The number of arguments attached to the transaction should be exactly 2.
                    Txn.application_args.length() == Int(1),

            ),
        )

        return Seq([
            App.globalPut(self.Variables.likes, App.globalGet(self.Variables.likes) + Int(1)),
            Approve()
        ])


    # dislike
    def dislike(self):

        Assert(
            And(
                    # The number of transactions within the group transaction must be exactly 2.
                    # first one being the adopt function and the second being the payment transactions
                    Global.group_size() == Int(1),

                    # Txn.applications[0] is a special index denoting the current app being interacted with
                    Txn.applications.length() == Int(1),

                    # The number of arguments attached to the transaction should be exactly 2.
                    Txn.application_args.length() == Int(1),
            ),
        )

        return Seq([
            App.globalPut(self.Variables.dislikes, App.globalGet(self.Variables.dislikes) + Int(1)),
            Approve()
        ])
        
    def application_deletion(self):
        return Return(Txn.sender() == Global.creator_address())

    def application_start(self):
        return Cond(
            [Txn.application_id() == Int(0), self.application_creation()],
            [Txn.on_completion() == OnComplete.DeleteApplication, self.application_deletion()],
            [Txn.application_args[0] == self.AppMethods.buy, self.buy()],
            [Txn.application_args[0] == self.AppMethods.like, self.like()],
            [Txn.application_args[0] == self.AppMethods.dislike, self.dislike()]
        )

    def approval_program(self):
        return self.application_start()

    def clear_program(self):
        return Return(Int(1))